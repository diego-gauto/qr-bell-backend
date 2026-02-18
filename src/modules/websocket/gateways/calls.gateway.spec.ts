import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CallsGateway } from './calls.gateway';
import { signVisitorToken } from '../../calls/utils/visitor-token';

function createMockSocket(overrides?: Partial<any>) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const peerEmitted: Array<{ event: string; payload: any }> = [];

  const to = jest.fn(() => ({
    emit: (event: string, payload: any) => {
      peerEmitted.push({ event, payload });
    }
  }));

  const socket: any = {
    handshake: {
      query: {},
      auth: {}
    },
    data: {},
    join: jest.fn(async () => undefined),
    emit: (event: string, payload: any) => {
      emitted.push({ event, payload });
    },
    to,
    disconnect: jest.fn(),
    __emitted: emitted,
    __peerEmitted: peerEmitted
  };

  return Object.assign(socket, overrides);
}

describe('CallsGateway', () => {
  it('replays accepted state to visitor connecting late', async () => {
    const callsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'e55dcc61-435e-468e-97d2-96db616e2cef',
        homeId: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
        status: 'accepted'
      })
    };
    const homesRepository = {
      findOne: jest.fn()
    };

    const jwtService = {
      verifyAsync: jest.fn()
    } as unknown as JwtService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'VISITOR_TOKEN_SECRET') return 'secret';
        return undefined;
      }),
      getOrThrow: jest.fn(() => 'secret')
    } as unknown as ConfigService;

    const gateway = new CallsGateway(
      callsRepository as any,
      homesRepository as any,
      jwtService,
      configService
    );

    const callId = 'e55dcc61-435e-468e-97d2-96db616e2cef';
    const visitorToken = signVisitorToken(callId, 'secret');

    const socket = createMockSocket({
      handshake: {
        query: {
          callId,
          visitorToken
        },
        auth: {}
      }
    });

    await gateway.handleConnection(socket as any);
    const acceptedEvent = socket.__emitted.find((x: any) => x.event === 'call:accepted');
    expect(acceptedEvent).toBeDefined();
    expect(acceptedEvent.payload.callId).toBe(callId);
  });

  it('replays missed state to visitor connecting late', async () => {
    const callsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'e55dcc61-435e-468e-97d2-96db616e2cef',
        homeId: '6f76cb04-ea20-43fa-8f4e-395527fb4efe',
        status: 'missed'
      })
    };
    const homesRepository = {
      findOne: jest.fn()
    };

    const jwtService = {
      verifyAsync: jest.fn()
    } as unknown as JwtService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'VISITOR_TOKEN_SECRET') return 'secret';
        return undefined;
      }),
      getOrThrow: jest.fn(() => 'secret')
    } as unknown as ConfigService;

    const gateway = new CallsGateway(
      callsRepository as any,
      homesRepository as any,
      jwtService,
      configService
    );

    const callId = 'e55dcc61-435e-468e-97d2-96db616e2cef';
    const visitorToken = signVisitorToken(callId, 'secret');

    const socket = createMockSocket({
      handshake: {
        query: {
          callId,
          visitorToken
        },
        auth: {}
      }
    });

    await gateway.handleConnection(socket as any);
    const endedEvent = socket.__emitted.find((x: any) => x.event === 'call:ended');
    expect(endedEvent).toBeDefined();
    expect(endedEvent.payload.callId).toBe(callId);
    expect(endedEvent.payload.reason).toBe('missed');
  });
});
