import { Module } from '@nestjs/common';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { TransactionRecordController } from './transaction-record.controller';
import { TransactionRecordService } from './transaction-record.service';

@Module({
    imports: [OperationLogModule],
    controllers: [TransactionRecordController],
    providers: [TransactionRecordService],
    exports: [TransactionRecordService],
})
export class TransactionRecordModule { }

