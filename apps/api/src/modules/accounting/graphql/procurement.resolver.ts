import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  billCreateSchema,
  billListQuerySchema,
  expenseCreateSchema,
  expenseDecisionSchema,
  expenseListQuerySchema,
  purchaseOrderCreateSchema,
  purchaseOrderListQuerySchema,
  vendorCreateSchema,
  vendorListQuerySchema,
  vendorUpdateSchema,
  type Bill,
  type BillCreateRequest,
  type BillListQuery,
  type BillPage,
  type Expense,
  type ExpenseCreateRequest,
  type ExpenseDecisionRequest,
  type ExpenseListQuery,
  type ExpensePage,
  type PurchaseOrder,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderListQuery,
  type PurchaseOrderPage,
  type Vendor,
  type VendorCreateRequest,
  type VendorListQuery,
  type VendorPage,
  type VendorUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { ProcurementService } from '../procurement.service';
import {
  BillCreateInput,
  BillListInput,
  ExpenseCreateInput,
  ExpenseDecisionInput,
  ExpenseListInput,
  PurchaseOrderCreateInput,
  PurchaseOrderListInput,
  VendorCreateInput,
  VendorListInput,
  VendorUpdateInput,
} from './inputs';
import {
  BillPageType,
  BillType,
  ExpensePageType,
  ExpenseType,
  PurchaseOrderPageType,
  PurchaseOrderType,
  VendorPageType,
  VendorType,
} from './types';

@Resolver(() => VendorType)
export class ProcurementResolver {
  constructor(private readonly procurement: ProcurementService) {}

  @Query(() => VendorPageType, { name: 'vendors' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listVendors(
    @Args('filter', { type: () => VendorListInput, nullable: true }, new ZodValidationPipe(vendorListQuerySchema.default({})))
    filter: VendorListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VendorPage> {
    return this.procurement.listVendors(tenantOf(principal), filter);
  }

  @Query(() => VendorType, { name: 'vendor' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getVendor(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Vendor> {
    return this.procurement.getVendor(tenantOf(principal), id);
  }

  @Mutation(() => VendorType, { name: 'createVendor' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createVendor(
    @Args('input', { type: () => VendorCreateInput }, new ZodValidationPipe(vendorCreateSchema))
    input: VendorCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Vendor> {
    return this.procurement.createVendor(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => VendorType, { name: 'updateVendor' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateVendor(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => VendorUpdateInput }, new ZodValidationPipe(vendorUpdateSchema))
    input: VendorUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Vendor> {
    return this.procurement.updateVendor(tenantOf(principal), principal.userId, id, input);
  }

  @Query(() => PurchaseOrderPageType, { name: 'purchaseOrders' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listPurchaseOrders(
    @Args('filter', { type: () => PurchaseOrderListInput, nullable: true }, new ZodValidationPipe(purchaseOrderListQuerySchema.default({})))
    filter: PurchaseOrderListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrderPage> {
    return this.procurement.listPurchaseOrders(tenantOf(principal), filter);
  }

  @Query(() => PurchaseOrderType, { name: 'purchaseOrder' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getPurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.getPurchaseOrder(tenantOf(principal), id);
  }

  @Mutation(() => PurchaseOrderType, { name: 'createPurchaseOrder' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createPurchaseOrder(
    @Args('input', { type: () => PurchaseOrderCreateInput }, new ZodValidationPipe(purchaseOrderCreateSchema))
    input: PurchaseOrderCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.createPurchaseOrder(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => PurchaseOrderType, { name: 'submitPurchaseOrder' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  submitPurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.submitPurchaseOrder(tenantOf(principal), principal.userId, id);
  }

  @Mutation(() => PurchaseOrderType, { name: 'approvePurchaseOrder' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  approvePurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.approvePurchaseOrder(tenantOf(principal), principal.userId, id);
  }

  @Query(() => BillPageType, { name: 'bills' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBills(
    @Args('filter', { type: () => BillListInput, nullable: true }, new ZodValidationPipe(billListQuerySchema.default({})))
    filter: BillListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BillPage> {
    return this.procurement.listBills(tenantOf(principal), filter);
  }

  @Query(() => BillType, { name: 'bill' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getBill(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.getBill(tenantOf(principal), id);
  }

  @Mutation(() => BillType, { name: 'createBill' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createBill(
    @Args('input', { type: () => BillCreateInput }, new ZodValidationPipe(billCreateSchema))
    input: BillCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.createBill(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => BillType, { name: 'approveBill' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  approveBill(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.approveBill(tenantOf(principal), principal.userId, id);
  }

  @Mutation(() => BillType, { name: 'postBill' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postBill(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.postBill(tenantOf(principal), principal.userId, id);
  }

  @Query(() => ExpensePageType, { name: 'expenses' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listExpenses(
    @Args('filter', { type: () => ExpenseListInput, nullable: true }, new ZodValidationPipe(expenseListQuerySchema.default({})))
    filter: ExpenseListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ExpensePage> {
    return this.procurement.listExpenses(tenantOf(principal), filter);
  }

  @Query(() => ExpenseType, { name: 'expense' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getExpense(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.getExpense(tenantOf(principal), id);
  }

  @Mutation(() => ExpenseType, { name: 'createExpense' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createExpense(
    @Args('input', { type: () => ExpenseCreateInput }, new ZodValidationPipe(expenseCreateSchema))
    input: ExpenseCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.createExpense(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => ExpenseType, { name: 'submitExpense' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  submitExpense(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.submitExpense(tenantOf(principal), principal.userId, id);
  }

  @Mutation(() => ExpenseType, { name: 'decideExpense' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  decideExpense(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => ExpenseDecisionInput }, new ZodValidationPipe(expenseDecisionSchema))
    input: ExpenseDecisionRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.decideExpense(tenantOf(principal), principal.userId, id, input);
  }

  @Mutation(() => ExpenseType, { name: 'postExpense' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postExpense(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.postExpense(tenantOf(principal), principal.userId, id);
  }
}
