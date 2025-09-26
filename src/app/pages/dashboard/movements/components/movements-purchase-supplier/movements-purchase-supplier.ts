import { ICustomer } from "src/app/core/interfaces/bussiness/customers.interface";
import { IOrderItem } from "src/app/core/interfaces/bussiness/order.interface";
import { IProduct } from "src/app/core/interfaces/bussiness/product.interface";
import { Iheader } from "src/app/core/interfaces/header.interface";
import { ISelectModalConfig, ISelectOption } from "src/app/core/interfaces/select-options-modal.interface";
import { IToastOptions } from "src/app/core/interfaces/toast.interface";

export const settingHeader: Iheader = {
  title: 'Agregar entrada',
  interface: 'modal'
};

export const customerOptionsModalConfig: ISelectModalConfig = {
  headerTitle: 'Cliente',
  optionsList: [],
  actionButton: true,
  multiple: false,
}

export const productOptionsModalConfig: ISelectModalConfig = {
  headerTitle: 'Productos',
  optionsList: [],
  actionButton: true,
  multiple: true,
};

export const waitingMessageCreatingOrder = "Creando orden...";

export const orderCreationMessages: Record<string, IToastOptions> = {
  "success": { message: 'Orden creada correctamente.', color: 'success'},
  "error": { message: 'No se logro crear la orden. Intentalo nuevamente.', color: 'danger'},
};

export const invalidFormMessage: IToastOptions = {
  message: 'Debes seleccionar un cliente y al menos un producto para continuar.',
  color: 'warning'
};

export function mapObjectToSelectOptions(customers: ICustomer[]): ISelectOption[] {
  return customers.map((customer) => ({
    title: customer.fullname,
    value: customer.id,
  }));
};

export function mapProductToSelectOptions(products: IProduct[]): ISelectOption[] {
  return products.map((product) => ({
    title: product.name,
    subtitle: `$${product.salePrice}`,
    value: product.id,
  }));
}

export function mapProductToOrderItem(product: IProduct, quantity: number = 1): IOrderItem {
  return {
    id: product.id,
    product: product,
    quantity: quantity
  };
}