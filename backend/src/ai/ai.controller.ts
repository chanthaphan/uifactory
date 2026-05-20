import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateUiDto } from './dto/generate.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Post('generate-ui')
  generateUi(@Body() dto: GenerateUiDto) {
    return this.service.generateUi(dto);
  }
}
