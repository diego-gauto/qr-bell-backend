import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { CallEntity } from '../../calls/entities/call.entity';
import { HomeEntity } from '../../homes/entities/home.entity';
import { verifyVisitorToken } from '../../calls/utils/visitor-token';

type ClientRole = 'owner' | 'visitor';

interface AuthPayload {
  token?: string;
}

interface JoinQuery {
  callId?: string;
  visitorToken?: string;
}

interface IcePayload {
  candidate: RTCIceCandidateInit;
}

interface SdpPayload {
  sdp: RTCSessionDescriptionInit;
}

interface EndPayload {
  reason?: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
}

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter((entry) => entry.length > 0);
}

function buildCorsOriginChecker(allowedOrigins: string[]) {
  const allowedSet = new Set(allowedOrigins);

  const vercelPrefixes = allowedOrigins
    .map((origin) => {
      try {
        return new URL(origin).hostname;
      } catch {
        return '';
      }
    })
    .filter((hostname) => hostname.endsWith('.vercel.app'))
    .map((hostname) => hostname.replace(/\.vercel\.app$/, ''))
    .filter((prefix) => prefix.length > 0);

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedSet.has(origin)) {
      callback(null, true);
      return;
    }

    try {
      const { hostname, protocol } = new URL(origin);
      if (protocol === 'https:' && hostname.endsWith('.vercel.app')) {
        const subdomain = hostname.replace(/\.vercel\.app$/, '');
        const allowedByPrefix = vercelPrefixes.some(
          (prefix) => subdomain === prefix || subdomain.startsWith(`${prefix}-`)
        );
        if (allowedByPrefix) {
          callback(null, true);
          return;
        }
      }
    } catch {
      // ignore
    }

    callback(new Error(`CORS: Origin no permitido: ${origin}`), false);
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: buildCorsOriginChecker(parseCorsOrigins(process.env['CORS_ORIGIN'] ?? 'http://localhost:3000')),
    credentials: true
  }
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CallsGateway.name);
  private readonly visitorTokenSecret: string;

  @WebSocketServer()
  private server!: Server;

  constructor(
    @InjectRepository(CallEntity)
    private readonly callsRepository: Repository<CallEntity>,
    @InjectRepository(HomeEntity)
    private readonly homesRepository: Repository<HomeEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    this.visitorTokenSecret =
      this.configService.get<string>('VISITOR_TOKEN_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const query = client.handshake.query as unknown as JoinQuery;
      const callId = typeof query.callId === 'string' ? query.callId : '';
      const visitorToken = typeof query.visitorToken === 'string' ? query.visitorToken : '';
      const auth = client.handshake.auth as AuthPayload;
      const bearer = typeof auth?.token === 'string' ? auth.token : '';

      if (!isUuid(callId)) {
        client.emit('call:error', { message: 'callId invalido' });
        client.disconnect(true);
        return;
      }

      const call = await this.callsRepository.findOne({ where: { id: callId } });
      if (!call) {
        client.emit('call:error', { message: 'Call not found' });
        client.disconnect(true);
        return;
      }

      let role: ClientRole | null = null;

      if (bearer) {
        const payload = await this.jwtService.verifyAsync<{ sub: string }>(bearer, {
          secret: this.configService.getOrThrow<string>('JWT_SECRET')
        });

        const home = await this.homesRepository.findOne({ where: { id: call.homeId } });
        if (!home || home.ownerId !== payload.sub) {
          client.emit('call:error', { message: 'Forbidden' });
          client.disconnect(true);
          return;
        }

        role = 'owner';
        client.data.userId = payload.sub;
      } else if (visitorToken) {
        const ok = verifyVisitorToken(callId, visitorToken, this.visitorTokenSecret);
        if (!ok) {
          client.emit('call:error', { message: 'Unauthorized' });
          client.disconnect(true);
          return;
        }
        role = 'visitor';
      }

      if (!role) {
        client.emit('call:error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      client.data.role = role;
      client.data.callId = callId;

      const room = this.roomName(callId);
      await client.join(room);

      // Notify peers.
      client.to(room).emit('call:peer_joined', { role });
      client.emit('call:joined', { role, callId });

      this.logger.log(`Socket connected role=${role} callId=${callId}`);
    } catch (error) {
      this.logger.warn(`Socket connection failed: ${(error as Error).message}`);
      try {
        client.disconnect(true);
      } catch {
        // ignore
      }
    }
  }

  handleDisconnect(client: Socket): void {
    const callId = typeof client.data?.callId === 'string' ? client.data.callId : '';
    if (callId) {
      const room = this.roomName(callId);
      client.to(room).emit('call:peer_left', { role: client.data?.role });
    }
  }

  @SubscribeMessage('call:accept')
  async onAccept(@ConnectedSocket() client: Socket): Promise<void> {
    if (client.data?.role !== 'owner') {
      return;
    }

    const callId = client.data.callId as string;
    const room = this.roomName(callId);
    this.server.to(room).emit('call:accepted', { callId });
  }

  @SubscribeMessage('call:end')
  async onEnd(@ConnectedSocket() client: Socket, @MessageBody() body: EndPayload): Promise<void> {
    const callId = client.data.callId as string;
    const room = this.roomName(callId);
    this.server.to(room).emit('call:ended', {
      callId,
      reason: typeof body?.reason === 'string' ? body.reason : 'ended'
    });
  }

  @SubscribeMessage('webrtc:offer')
  async onOffer(@ConnectedSocket() client: Socket, @MessageBody() body: SdpPayload): Promise<void> {
    if (client.data?.role !== 'visitor') {
      return;
    }
    const callId = client.data.callId as string;
    client.to(this.roomName(callId)).emit('webrtc:offer', body);
  }

  @SubscribeMessage('webrtc:answer')
  async onAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: SdpPayload): Promise<void> {
    if (client.data?.role !== 'owner') {
      return;
    }
    const callId = client.data.callId as string;
    client.to(this.roomName(callId)).emit('webrtc:answer', body);
  }

  @SubscribeMessage('webrtc:ice')
  async onIce(@ConnectedSocket() client: Socket, @MessageBody() body: IcePayload): Promise<void> {
    const callId = client.data.callId as string;
    client.to(this.roomName(callId)).emit('webrtc:ice', body);
  }

  private roomName(callId: string): string {
    return `call:${callId}`;
  }
}

