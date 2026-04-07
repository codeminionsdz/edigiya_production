'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  getContactMessages, 
  updateContactMessage, 
  deleteContactMessage 
} from '@/app/admin/messages/actions';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Mail, MailOpen, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  is_read: boolean;
  admin_note: string | null;
  created_at: string;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadMessages = async () => {
    setLoading(true);
    try {
      const result = await getContactMessages({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setMessages(result.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Échec du chargement des messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [statusFilter]);

  const handleViewMessage = async (message: ContactMessage) => {
    setSelectedMessage(message);
    setAdminNote(message.admin_note || '');
    setIsDialogOpen(true);

    // Mark as read if not already
    if (!message.is_read) {
      try {
        await updateContactMessage(message.id, { is_read: true });
        loadMessages();
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await updateContactMessage(id, { status });
      toast.success('Statut mis à jour');
      loadMessages();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Échec de la mise à jour du statut');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedMessage) return;
    
    try {
      await updateContactMessage(selectedMessage.id, { admin_note: adminNote });
      toast.success('Note sauvegardée');
      setIsDialogOpen(false);
      loadMessages();
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Échec de la sauvegarde de la note');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce message?')) return;
    
    try {
      await deleteContactMessage(id);
      toast.success('Message supprimé');
      loadMessages();
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Échec de la suppression');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'read':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'replied':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubjectLabel = (subject: string) => {
    const labels: Record<string, string> = {
      order: 'Question sur une commande',
      product: 'Information produit',
      return: 'Retour / Remboursement',
      partnership: 'Partenariat',
      other: 'Autre',
    };
    return labels[subject] || subject;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages de Contact</h1>
        <p className="text-muted-foreground">
          Gérez les messages reçus via le formulaire de contact
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Non lus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {messages.filter((m) => !m.is_read).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Répondus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {messages.filter((m) => m.status === 'replied').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Archivés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {messages.filter((m) => m.status === 'archived').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Messages</CardTitle>
              <CardDescription>Liste de tous les messages reçus</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unread">Non lus</SelectItem>
                <SelectItem value="read">Lus</SelectItem>
                <SelectItem value="replied">Répondus</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Aucun message trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id} className={!message.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                    <TableCell>
                      {message.is_read ? (
                        <MailOpen className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Mail className="h-5 w-5 text-blue-600" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{message.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{message.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getSubjectLabel(message.subject)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(message.status)}>
                        {message.status === 'unread' && 'Non lu'}
                        {message.status === 'read' && 'Lu'}
                        {message.status === 'replied' && 'Répondu'}
                        {message.status === 'archived' && 'Archivé'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewMessage(message)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(message.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Message Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du message</DialogTitle>
            <DialogDescription>
              Message de {selectedMessage?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Nom</Label>
                <div className="rounded-md border bg-muted p-2 text-sm">{selectedMessage.name}</div>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <div className="rounded-md border bg-muted p-2 text-sm">{selectedMessage.email}</div>
              </div>
              <div className="grid gap-2">
                <Label>Sujet</Label>
                <div className="rounded-md border bg-muted p-2 text-sm">
                  {getSubjectLabel(selectedMessage.subject)}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Message</Label>
                <div className="rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Statut</Label>
                <Select
                  value={selectedMessage.status}
                  onValueChange={(value) => handleUpdateStatus(selectedMessage.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unread">Non lu</SelectItem>
                    <SelectItem value="read">Lu</SelectItem>
                    <SelectItem value="replied">Répondu</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Note admin (privée)</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ajouter une note privée..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSaveNote}>Sauvegarder</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
