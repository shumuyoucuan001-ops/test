import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import type { OpsExclusionItem } from './ops-exclusion.service';
import { OpsExclusionService } from './ops-exclusion.service';

@Controller('ops-exclusion')
export class OpsExclusionController {
    constructor(private service: OpsExclusionService) { }

    @Get()
    async list(@Query('q') q?: string): Promise<OpsExclusionItem[]> {
        return this.service.list(q);
    }

    @Post()
    async create(@Body() body: OpsExclusionItem) {
        await this.service.create(body);
        return { success: true };
    }

    @Patch()
    async update(@Body() body: { original: OpsExclusionItem; data: OpsExclusionItem }) {
        await this.service.update(body.original, body.data);
        return { success: true };
    }

    @Delete()
    async remove(@Body() body: OpsExclusionItem) {
        await this.service.remove(body);
        return { success: true };
    }
}
