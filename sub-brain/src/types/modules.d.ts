// Type declarations for optional dependencies that may not have @types packages

declare module "nodemailer" {
  export function createTransporter(options: any): any;
}

declare module "imap-simple" {
  export function connect(options: any): Promise<any>;
}

declare module "web-push" {
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(subscription: any, payload: string): Promise<any>;
}

declare module "puppeteer" {
  export function launch(options?: any): Promise<any>;
}

declare module "chrome-remote-interface" {
  function CDP(options: any): Promise<any>;
  export default CDP;
}

declare module "glob" {
  export function globSync(pattern: string, options?: any): string[];
}

declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): any;
  }
}
