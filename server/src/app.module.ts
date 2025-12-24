import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AclModule } from './acl/acl.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DingTalkModule } from './dingtalk/dingtalk.module';
import { HealthController } from './health/health.controller';
import { LabelDataModule } from './label-data/label-data.module';
import { LabelPrintModule } from './label-print/label-print.module';
import { MaxPurchaseQuantityModule } from './max-purchase-quantity/max-purchase-quantity.module';
import { MaxStoreSkuInventoryModule } from './max-store-sku-inventory/max-store-sku-inventory.module';
import { OpsActivityDispatchModule } from './ops-activity-dispatch/ops-activity-dispatch.module';
import { OpsExclusionModule } from './ops-exclusion/ops-exclusion.module';
import { OpsShelfExclusionModule } from './ops-shelf-exclusion/ops-shelf-exclusion.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';
import { PurchasePassDifferenceModule } from './purchase-pass-difference/purchase-pass-difference.module';
import { ReceiptModule } from './receipt/receipt.module';
import { Refund1688FollowUpModule } from './refund-1688-follow-up/refund-1688-follow-up.module';
import { StoreRejectionModule } from './store-rejection/store-rejection.module';
import { SupplierManagementModule } from './supplier-management/supplier-management.module';
import { SupplierModule } from './supplier/supplier.module';
import { TemplateModule } from './template/template.module';
import { VersionModule } from './version/version.module';
// 暂时关闭后端接口权限拦截

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TemplateModule,
    ProductModule,
    ReceiptModule,
    LabelDataModule,
    LabelPrintModule,
    SupplierManagementModule,
    AclModule,
    SupplierModule,
    VersionModule,
    DingTalkModule,
    OpsExclusionModule,
    OpsShelfExclusionModule,
    OpsActivityDispatchModule,
    StoreRejectionModule,
    MaxPurchaseQuantityModule,
    MaxStoreSkuInventoryModule,
    PurchasePassDifferenceModule,
    Refund1688FollowUpModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule { }
