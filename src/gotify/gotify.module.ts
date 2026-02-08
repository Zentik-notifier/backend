import { Module } from '@nestjs/common';
import { GotifyService } from './gotify.service';

@Module({
  providers: [GotifyService],
  exports: [GotifyService],
})
export class GotifyModule {}
