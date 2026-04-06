import { Body, Controller, HttpCode, Post, Request } from '@nestjs/common';
import { jsonApiMeta } from '../../shared/jsonapi/jsonapi';
import { InitiateTransferDto } from './dto/initiate-transfer.input';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('/')
  @HttpCode(202)
  async initiateTransfer(@Request() req, @Body() input: InitiateTransferDto) {
    await this.transfersService.initiateTransfer(
      req.user.id,
      req.user.email,
      input,
    );

    return jsonApiMeta({
      message: 'Transfer accepted',
    });
  }
}
