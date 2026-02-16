declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string
  ): Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }>;
}
