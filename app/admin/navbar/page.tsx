"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Save,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getAllNavbarItems,
  getAllCustomPages,
  createNavbarItem,
  updateNavbarItem,
  deleteNavbarItem,
  createCustomPage,
  updateCustomPage,
  deleteCustomPage,
  toggleCustomPageActive,
} from "@/app/admin/navbar/actions";

interface NavbarItem {
  id: string;
  label_ar: string;
  label_fr: string;
  url: string;
  sort_order: number;
  is_active: boolean;
  type: string;
  target: string;
  icon_name?: string;
}

interface CustomPage {
  id: string;
  slug: string;
  title_ar: string;
  title_fr: string;
  content_ar?: string;
  content_fr?: string;
  meta_description_ar?: string;
  meta_description_fr?: string;
  is_active: boolean;
  is_navbar_visible: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminNavbarPage() {
  const [navbarItems, setNavbarItems] = useState<NavbarItem[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);

  // Navbar item dialog state
  const [isNavbarDialogOpen, setIsNavbarDialogOpen] = useState(false);
  const [editingNavbarId, setEditingNavbarId] = useState<string | null>(null);
  const [navbarForm, setNavbarForm] = useState({
    label_ar: "",
    label_fr: "",
    url: "",
    type: "link",
    target: "_self",
  });

  // Custom page dialog state
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageForm, setPageForm] = useState({
    slug: "",
    title_ar: "",
    title_fr: "",
    content_ar: "",
    content_fr: "",
    meta_description_ar: "",
    meta_description_fr: "",
    is_navbar_visible: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [navbarResult, pagesResult] = await Promise.all([
        getAllNavbarItems(),
        getAllCustomPages(),
      ]);

      if (navbarResult.data) setNavbarItems(navbarResult.data);
      if (pagesResult.data) setCustomPages(pagesResult.data);
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ============ NAVBAR ITEM HANDLERS ============

  const handleAddNavbarItem = () => {
    setEditingNavbarId(null);
    setNavbarForm({
      label_ar: "",
      label_fr: "",
      url: "",
      type: "link",
      target: "_self",
    });
    setIsNavbarDialogOpen(true);
  };

  const handleEditNavbarItem = (item: NavbarItem) => {
    setEditingNavbarId(item.id);
    setNavbarForm({
      label_ar: item.label_ar,
      label_fr: item.label_fr,
      url: item.url,
      type: item.type,
      target: item.target,
    });
    setIsNavbarDialogOpen(true);
  };

  const handleSaveNavbarItem = async () => {
    if (!navbarForm.label_ar || !navbarForm.label_fr || !navbarForm.url) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingNavbarId) {
        const result = await updateNavbarItem(editingNavbarId, navbarForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setNavbarItems(
          navbarItems.map((item) =>
            item.id === editingNavbarId ? { ...item, ...navbarForm } : item,
          ),
        );
        toast.success("Navbar item updated");
      } else {
        const result = await createNavbarItem({
          ...navbarForm,
          sort_order: navbarItems.length,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data) {
          setNavbarItems([...navbarItems, result.data as NavbarItem]);
          toast.success("Navbar item created");
        }
      }
      setIsNavbarDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save navbar item");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNavbarItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this navbar item?")) return;

    try {
      const result = await deleteNavbarItem(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNavbarItems(navbarItems.filter((item) => item.id !== id));
      toast.success("Navbar item deleted");
    } catch (error) {
      toast.error("Failed to delete navbar item");
      console.error(error);
    }
  };

  const handleToggleNavbarItem = async (id: string, isActive: boolean) => {
    try {
      const result = await updateNavbarItem(id, { is_active: !isActive });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNavbarItems(
        navbarItems.map((item) =>
          item.id === id ? { ...item, is_active: !isActive } : item,
        ),
      );
      toast.success(isActive ? "Item deactivated" : "Item activated");
    } catch (error) {
      toast.error("Failed to toggle item");
      console.error(error);
    }
  };

  // ============ CUSTOM PAGE HANDLERS ============

  const handleAddPage = () => {
    setEditingPageId(null);
    setPageForm({
      slug: "",
      title_ar: "",
      title_fr: "",
      content_ar: "",
      content_fr: "",
      meta_description_ar: "",
      meta_description_fr: "",
      is_navbar_visible: false,
    });
    setIsPageDialogOpen(true);
  };

  const handleEditPage = (page: CustomPage) => {
    setEditingPageId(page.id);
    setPageForm({
      slug: page.slug,
      title_ar: page.title_ar,
      title_fr: page.title_fr,
      content_ar: page.content_ar || "",
      content_fr: page.content_fr || "",
      meta_description_ar: page.meta_description_ar || "",
      meta_description_fr: page.meta_description_fr || "",
      is_navbar_visible: page.is_navbar_visible,
    });
    setIsPageDialogOpen(true);
  };

  const handleSavePage = async () => {
    if (!pageForm.slug || !pageForm.title_ar || !pageForm.title_fr) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingPageId) {
        const result = await updateCustomPage(editingPageId, {
          title_ar: pageForm.title_ar,
          title_fr: pageForm.title_fr,
          content_ar: pageForm.content_ar,
          content_fr: pageForm.content_fr,
          meta_description_ar: pageForm.meta_description_ar,
          meta_description_fr: pageForm.meta_description_fr,
          is_navbar_visible: pageForm.is_navbar_visible,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setCustomPages(
          customPages.map((page) =>
            page.id === editingPageId
              ? {
                  ...page,
                  title_ar: pageForm.title_ar,
                  title_fr: pageForm.title_fr,
                  content_ar: pageForm.content_ar,
                  content_fr: pageForm.content_fr,
                  meta_description_ar: pageForm.meta_description_ar,
                  meta_description_fr: pageForm.meta_description_fr,
                  is_navbar_visible: pageForm.is_navbar_visible,
                }
              : page,
          ),
        );
        toast.success("Page updated");
      } else {
        const result = await createCustomPage({
          ...pageForm,
          sort_order: customPages.length,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data) {
          setCustomPages([...customPages, result.data as CustomPage]);
          toast.success("Page created");
        }
      }
      setIsPageDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save page");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;

    try {
      const result = await deleteCustomPage(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCustomPages(customPages.filter((page) => page.id !== id));
      toast.success("Page deleted");
    } catch (error) {
      toast.error("Failed to delete page");
      console.error(error);
    }
  };

  const handleTogglePageActive = async (id: string, isActive: boolean) => {
    try {
      const result = await toggleCustomPageActive(id, !isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCustomPages(
        customPages.map((page) =>
          page.id === id ? { ...page, is_active: !isActive } : page,
        ),
      );
      toast.success(isActive ? "Page deactivated" : "Page activated");
    } catch (error) {
      toast.error("Failed to toggle page");
      console.error(error);
    }
  };

  const handleTogglePageNavbarVisibility = async (
    id: string,
    isVisible: boolean,
  ) => {
    try {
      const result = await updateCustomPage(id, {
        is_navbar_visible: !isVisible,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCustomPages(
        customPages.map((page) =>
          page.id === id ? { ...page, is_navbar_visible: !isVisible } : page,
        ),
      );
      toast.success(isVisible ? "Hidden from navbar" : "Visible in navbar");
    } catch (error) {
      toast.error("Failed to update navbar visibility");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Navbar Items Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Navbar Items</CardTitle>
              <CardDescription>Manage navigation bar items</CardDescription>
            </div>
            <Dialog
              open={isNavbarDialogOpen}
              onOpenChange={setIsNavbarDialogOpen}
            >
              <DialogTrigger asChild>
                <Button onClick={handleAddNavbarItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingNavbarId
                      ? "Edit Navbar Item"
                      : "Create Navbar Item"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="label_ar">Label (Arabic) *</Label>
                      <Input
                        id="label_ar"
                        value={navbarForm.label_ar}
                        onChange={(e) =>
                          setNavbarForm({
                            ...navbarForm,
                            label_ar: e.target.value,
                          })
                        }
                        placeholder="Label in Arabic"
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="label_fr">Label (French) *</Label>
                      <Input
                        id="label_fr"
                        value={navbarForm.label_fr}
                        onChange={(e) =>
                          setNavbarForm({
                            ...navbarForm,
                            label_fr: e.target.value,
                          })
                        }
                        placeholder="Label in French"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="url">URL *</Label>
                    <Input
                      id="url"
                      value={navbarForm.url}
                      onChange={(e) =>
                        setNavbarForm({ ...navbarForm, url: e.target.value })
                      }
                      placeholder="e.g., /products, https://example.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <select
                        id="type"
                        value={navbarForm.type}
                        onChange={(e) =>
                          setNavbarForm({ ...navbarForm, type: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                      >
                        <option value="link">Link</option>
                        <option value="custom_page">Custom Page</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="target">Target</Label>
                      <select
                        id="target"
                        value={navbarForm.target}
                        onChange={(e) =>
                          setNavbarForm({
                            ...navbarForm,
                            target: e.target.value,
                          })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                      >
                        <option value="_self">Same Tab</option>
                        <option value="_blank">New Tab</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSaveNavbarItem}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsNavbarDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {navbarItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No navbar items yet
              </p>
            ) : (
              navbarItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-semibold">{item.label_fr}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.url}
                    </div>
                  </div>
                  <Badge variant={item.is_active ? "default" : "secondary"}>
                    {item.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleToggleNavbarItem(item.id, item.is_active)
                    }
                  >
                    {item.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditNavbarItem(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteNavbarItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Pages Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Pages</CardTitle>
              <CardDescription>
                Create and manage custom pages for your store
              </CardDescription>
            </div>
            <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddPage}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Page
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPageId ? "Edit Page" : "Create New Page"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[80vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="slug">Slug *</Label>
                      <Input
                        id="slug"
                        value={pageForm.slug}
                        onChange={(e) =>
                          setPageForm({
                            ...pageForm,
                            slug: e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "-"),
                          })
                        }
                        placeholder="page-slug"
                        disabled={!!editingPageId}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        URL: /pages/{pageForm.slug}
                      </p>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_navbar_visible"
                          checked={pageForm.is_navbar_visible}
                          onCheckedChange={(checked) =>
                            setPageForm({
                              ...pageForm,
                              is_navbar_visible: checked,
                            })
                          }
                        />
                        <Label
                          htmlFor="is_navbar_visible"
                          className="cursor-pointer"
                        >
                          Show in Navbar
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title_ar">Title (Arabic) *</Label>
                      <Input
                        id="title_ar"
                        value={pageForm.title_ar}
                        onChange={(e) =>
                          setPageForm({ ...pageForm, title_ar: e.target.value })
                        }
                        placeholder="عنوان الصفحة"
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="title_fr">Title (French) *</Label>
                      <Input
                        id="title_fr"
                        value={pageForm.title_fr}
                        onChange={(e) =>
                          setPageForm({ ...pageForm, title_fr: e.target.value })
                        }
                        placeholder="Titre de la page"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="meta_description_ar">
                        Meta Description (Arabic)
                      </Label>
                      <Input
                        id="meta_description_ar"
                        value={pageForm.meta_description_ar}
                        onChange={(e) =>
                          setPageForm({
                            ...pageForm,
                            meta_description_ar: e.target.value,
                          })
                        }
                        placeholder="وصف الصفحة"
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="meta_description_fr">
                        Meta Description (French)
                      </Label>
                      <Input
                        id="meta_description_fr"
                        value={pageForm.meta_description_fr}
                        onChange={(e) =>
                          setPageForm({
                            ...pageForm,
                            meta_description_fr: e.target.value,
                          })
                        }
                        placeholder="Description de la page"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="content_ar">Content (Arabic)</Label>
                      <Textarea
                        id="content_ar"
                        value={pageForm.content_ar}
                        onChange={(e) =>
                          setPageForm({
                            ...pageForm,
                            content_ar: e.target.value,
                          })
                        }
                        placeholder="محتوى الصفحة"
                        rows={5}
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content_fr">Content (French)</Label>
                      <Textarea
                        id="content_fr"
                        value={pageForm.content_fr}
                        onChange={(e) =>
                          setPageForm({
                            ...pageForm,
                            content_fr: e.target.value,
                          })
                        }
                        placeholder="Contenu de la page"
                        rows={5}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSavePage}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsPageDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {customPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom pages yet
              </p>
            ) : (
              customPages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{page.title_fr}</div>
                    <div className="text-sm text-muted-foreground">
                      /{page.slug}
                    </div>
                  </div>
                  <Badge variant={page.is_active ? "default" : "secondary"}>
                    {page.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {page.is_navbar_visible && (
                    <Badge variant="outline">
                      <Eye className="mr-1 h-3 w-3" />
                      In Navbar
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleTogglePageNavbarVisibility(
                        page.id,
                        page.is_navbar_visible,
                      )
                    }
                    title={
                      page.is_navbar_visible
                        ? "Hide from navbar"
                        : "Show in navbar"
                    }
                  >
                    {page.is_navbar_visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleTogglePageActive(page.id, page.is_active)
                    }
                  >
                    {page.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditPage(page)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeletePage(page.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
