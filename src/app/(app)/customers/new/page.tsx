import { CustomerForm, EMPTY_CUSTOMER } from '@/components/customer-form';
import { createCustomerAction } from '../actions';

export default function NewCustomerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เพิ่มลูกค้า</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <CustomerForm initial={EMPTY_CUSTOMER} onSubmit={createCustomerAction} submitLabel="บันทึก" />
      </div>
    </div>
  );
}
