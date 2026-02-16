export const pushConfig = {
  publicKey: process.env['VAPID_PUBLIC_KEY'] ?? '',
  privateKey: process.env['VAPID_PRIVATE_KEY'] ?? '',
  subject: process.env['VAPID_SUBJECT'] ?? ''
};
