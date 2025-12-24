import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class WsVars {
  @IsNumber()
  @IsOptional()
  WS_CONNECT_TIMEOUT: number = 50000;

  @IsNumber()
  @IsOptional()
  WS_PING_INTERVAL: number = 25000;

  @IsNumber()
  @IsOptional()
  WS_PING_TIMEOUT: number = 5000;

  @IsBoolean()
  @IsOptional()
  WS_CLEANUP_EMPTY_CHILD_NAMESPACES: boolean = true;

  @IsString()
  @IsOptional()
  WS_PATH: string = '/ws';

  @IsNumber()
  @IsOptional()
  WS_PORT?: number;

  @IsOptional()
  @Transform(({ obj }) => {
    if (typeof obj.WS_TRANSPORTS === 'string') {
      return obj.WS_TRANSPORTS.split(',').map(
        (transport: 'websocket' | 'polling') => transport.trim(),
      );
    }
    return ['websocket'];
  })
  WS_TRANSPORTS: ('websocket' | 'polling')[] = ['websocket'];
}
