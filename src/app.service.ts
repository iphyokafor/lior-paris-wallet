import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getBaseRoute(): string {
    return 'Welcome to Lior-Paris Wallet API!';
  }
}
