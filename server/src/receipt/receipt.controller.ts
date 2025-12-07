import { Controller, Get, Query, Param } from '@nestjs/common';
import { ReceiptService, ReceiptDetailWithProduct } from './receipt.service';

@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Get('numbers')
  getAllReceiptNumbers(): Promise<string[]> {
    return this.receiptService.getAllReceiptNumbers();
  }

  @Get('numbers/search')
  searchReceiptNumbers(@Query('keyword') keyword: string): Promise<string[]> {
    return this.receiptService.searchReceiptNumbers(keyword);
  }

  @Get(':receiptNo/details')
  findByReceiptNo(@Param('receiptNo') receiptNo: string): Promise<ReceiptDetailWithProduct[]> {
    return this.receiptService.findByReceiptNo(receiptNo);
  }

  @Get(':receiptNo/summary')
  getReceiptSummary(@Param('receiptNo') receiptNo: string) {
    return this.receiptService.getReceiptSummary(receiptNo);
  }
}
