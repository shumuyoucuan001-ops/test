import { Controller, Get, Query, Param, Put, Post, Delete, Body } from '@nestjs/common';
import { ProductService, ProductSalesSpec, ProductLabel, ProductWithLabels } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(): Promise<ProductSalesSpec[]> {
    return this.productService.findAll();
  }

  @Get('search')
  search(@Query('keyword') keyword: string): Promise<ProductSalesSpec[]> {
    return this.productService.search(keyword);
  }

  @Get('barcode/:barcode')
  async findByBarcode(@Param('barcode') barcode: string): Promise<ProductSalesSpec | null> {
    return this.productService.findByBarcode(barcode);
  }

  @Get('sku/:skuCode')
  async findBySkuCode(@Param('skuCode') skuCode: string): Promise<ProductSalesSpec | null> {
    return this.productService.findBySkuCode(skuCode);
  }

  @Get('with-labels')
  findAllWithLabels(): Promise<ProductWithLabels[]> {
    return this.productService.findAllWithLabels();
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<ProductSalesSpec> {
    return this.productService.findById(+id);
  }

  @Get(':productCode/labels')
  getLabelsByProductCode(@Param('productCode') productCode: string): Promise<ProductLabel[]> {
    return this.productService.getLabelsByProductCode(productCode);
  }

  @Put(':id')
  updateProduct(@Param('id') id: string, @Body() updateData: Partial<ProductSalesSpec>): Promise<ProductSalesSpec> {
    return this.productService.updateProduct(+id, updateData);
  }

  @Post('labels')
  createLabel(@Body() labelData: Omit<ProductLabel, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductLabel> {
    return this.productService.createLabel(labelData);
  }

  @Put('labels/:id')
  updateLabel(@Param('id') id: string, @Body() updateData: Partial<ProductLabel>): Promise<ProductLabel> {
    return this.productService.updateLabel(+id, updateData);
  }

  @Delete('labels/:id')
  deleteLabel(@Param('id') id: string): Promise<ProductLabel> {
    return this.productService.deleteLabel(+id);
  }
}
