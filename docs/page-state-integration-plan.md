# 页面状态保持功能集成计划

由于需要集成的页面较多（17个），我将分批处理。已完成：
- ✅ 标签资料管理 (ProductSupplementPage)
- ✅ 商品资料 (ProductMasterPage)  
- ✅ 供应商管理 (SupplierManagementPage)

待处理页面：
1. 供应商推送换算关系变更 (SupplierConversionRelationPage)
2. 1688退款(退货)跟进情况 (Refund1688FollowUpPage)
3. 排除活动商品 (OpsExclusionPage)
4. 手动强制活动分发 (OpsActivityDispatchPage)
5. 手动常规活动分发 (OpsRegularActivityDispatchPage)
6. 排除上下架商品 (OpsShelfExclusionPage)
7. 驳回差异单 (StoreRejectionPage)
8. 单次最高采购量 (MaxPurchaseQuantityPage)
9. 仓店sku最高库存 (MaxStoreSkuInventoryPage)
10. 账单手动绑定采购单 (FinanceManagementPage)
11. 账单对账汇总差异 (FinanceReconciliationDifferencePage)
12. 流水记录 (TransactionRecordPage)
13. 非采购单流水记录 (NonPurchaseBillRecordPage)
14. 采购单金额调整 (PurchaseAmountAdjustmentPage)
15. 供应商报价 (SupplierQuotationPage)

## 集成步骤（每个页面）

1. 导入 hooks
   ```typescript
   import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
   import { useRef } from 'react';
   ```

2. 定义 PAGE_KEY 和 defaultState
   ```typescript
   const PAGE_KEY = 'page-key';
   const defaultState = {
     currentPage: 1,
     pageSize: 20,
     searchText: '',
     // ... 其他需要保存的状态
   };
   ```

3. 恢复状态
   ```typescript
   const restoredState = usePageStateRestore(PAGE_KEY, defaultState);
   ```

4. 使用恢复的状态初始化 state
   ```typescript
   const [currentPage, setCurrentPage] = useState(
     restoredState?.currentPage ?? defaultState.currentPage
   );
   ```

5. 保存状态
   ```typescript
   usePageStateSave(PAGE_KEY, {
     currentPage,
     pageSize,
     searchText,
     // ... 其他需要保存的状态
   });
   ```

6. 在状态恢复后重新加载数据
   ```typescript
   const hasInitialLoadRef = useRef(false);
   
   useEffect(() => {
     if (!hasInitialLoadRef.current) {
       hasInitialLoadRef.current = true;
       load();
     }
   }, []);
   
   useEffect(() => {
     if (hasInitialLoadRef.current) {
       load();
     }
   }, [currentPage, pageSize]);
   ```

