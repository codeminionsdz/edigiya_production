import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Server-side client with service key (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Database access functions for server-side operations
export const db = {
  // Departments
  async getDepartments() {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  async createDepartment(name: string) {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert([{ name }])
      .select();
    if (error) throw error;
    return data[0];
  },

  async updateDepartment(id: string, name: string) {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .update({ name })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  async deleteDepartment(id: string) {
    const { error } = await supabaseAdmin
      .from('departments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Categories
  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*, departments(name)')
      .order('name');
    if (error) throw error;
    return data;
  },

  async createCategory(name: string, departmentId: string) {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert([{ name, department_id: departmentId }])
      .select();
    if (error) throw error;
    return data[0];
  },

  async updateCategory(id: string, name: string, departmentId: string) {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({ name, department_id: departmentId })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  async deleteCategory(id: string) {
    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Products
  async getProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name), departments(name)')
      .order('name');
    if (error) throw error;
    return data;
  },

  async getProductById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name), departments(name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createProduct(product: {
    name: string;
    description: string;
    price: number;
    stock: number;
    category_id: string;
    department_id: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([product])
      .select();
    if (error) throw error;
    return data[0];
  },

  async updateProduct(
    id: string,
    product: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      category_id?: string;
      department_id?: string;
    }
  ) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update(product)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  async deleteProduct(id: string) {
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Orders
  async getOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, price))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getOrderById(id: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, price))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createOrder(order: {
    customer_email: string;
    total_price: number;
    shipping_method_id: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert([order])
      .select();
    if (error) throw error;
    return data[0];
  },

  async updateOrderStatus(
    id: string,
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  // Order Items
  async createOrderItem(orderItem: {
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
  }) {
    const { data, error } = await supabaseAdmin
      .from('order_items')
      .insert([orderItem])
      .select();
    if (error) throw error;
    return data[0];
  },

  // Shipping Methods
  async getShippingMethods() {
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  async createShippingMethod(method: {
    name: string;
    cost: number;
    estimated_days: number;
  }) {
    const { data, error } = await supabaseAdmin
      .from('shipping_methods')
      .insert([method])
      .select();
    if (error) throw error;
    return data[0];
  },

  async updateShippingMethod(
    id: string,
    method: {
      name?: string;
      cost?: number;
      estimated_days?: number;
    }
  ) {
    const { data, error } = await supabaseAdmin
      .from('shipping_methods')
      .update(method)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  async deleteShippingMethod(id: string) {
    const { error } = await supabaseAdmin
      .from('shipping_methods')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
