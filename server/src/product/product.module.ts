import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductMasterController } from './master.controller';

@Module({
  controllers: [ProductController, ProductMasterController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
