import { Controller, Get, Query } from '@nestjs/common';
import { LabelPrintService } from './label-print.service';

@Controller('label-print')
export class LabelPrintController {
  constructor(private service: LabelPrintService) {}

  @Get('search')
  async search(@Query('q') q = '') {
    return this.service.search(q);
  }
}


