'use server';

import * as repo from '@/lib/repositories';

export async function getContactMessages(filters?: {
  status?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}) {
  try {
    return await repo.getContactMessages(filters);
  } catch (error: any) {
    console.error('Failed to get contact messages:', error);
    return { messages: [], total: 0 };
  }
}

export async function updateContactMessage(
  id: string,
  data: {
    status?: string;
    is_read?: boolean;
    admin_note?: string;
  }
) {
  try {
    return await repo.updateContactMessage(id, data);
  } catch (error: any) {
    console.error('Failed to update contact message:', error);
    throw error;
  }
}

export async function deleteContactMessage(id: string) {
  try {
    return await repo.deleteContactMessage(id);
  } catch (error: any) {
    console.error('Failed to delete contact message:', error);
    throw error;
  }
}
