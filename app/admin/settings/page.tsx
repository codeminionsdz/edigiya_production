"use client"

import { useEffect, useState } from "react"
import { Save, Store, Bell, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DEFAULT_STORE_SETTINGS,
  loadStoreSettings,
  saveStoreSettings,
  StoreSettings,
} from "@/lib/store-settings"

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS)
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    try {
      setSettings(loadStoreSettings())
    } catch (error) {
      console.error("Failed to load admin settings from localStorage:", error)
    }
  }, [])

  const setField = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    try {
      saveStoreSettings(settings)
      setSaveMessage("Parametres enregistres avec succes.")
    } catch (error) {
      console.error("Failed to save admin settings:", error)
      setSaveMessage("Erreur pendant l'enregistrement.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Parametres</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configurez votre boutique</p>
          {saveMessage ? <p className="mt-1 text-xs text-primary">{saveMessage}</p> : null}
        </div>
        <Button className="gap-2" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Enregistrer
        </Button>
      </div>

      <Tabs defaultValue="store">
        <TabsList className="bg-muted">
          <TabsTrigger value="store" className="gap-1.5"><Store className="h-3.5 w-3.5" />Boutique</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Securite</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Informations du magasin</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <Label>Nom du magasin</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.storeName}
                    onChange={(e) => setField("storeName", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={3}
                    value={settings.description}
                    onChange={(e) => setField("description", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email de contact</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.contactEmail}
                    onChange={(e) => setField("contactEmail", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telephone principal</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.phonePrimary}
                    onChange={(e) => setField("phonePrimary", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telephone secondaire</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.phoneSecondary}
                    onChange={(e) => setField("phoneSecondary", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Adresse</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.address}
                    onChange={(e) => setField("address", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Lien Google Maps</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.mapLink}
                    onChange={(e) => setField("mapLink", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Carte iframe</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={4}
                    value={settings.mapEmbed}
                    onChange={(e) => setField("mapEmbed", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Heures de travail</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.workingHours}
                    onChange={(e) => setField("workingHours", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Reseaux sociaux</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <Label>WhatsApp</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.whatsapp}
                    onChange={(e) => setField("whatsapp", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Facebook</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.facebook}
                    onChange={(e) => setField("facebook", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.instagram}
                    onChange={(e) => setField("instagram", e.target.value)}
                  />
                </div>
                <div>
                  <Label>TikTok</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.tiktok}
                    onChange={(e) => setField("tiktok", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Preferences de notification</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {[
                { label: "Nouvelle commande", desc: "Recevoir une notification pour chaque nouvelle commande" },
                { label: "Stock faible", desc: "Alerte quand un produit est en stock faible" },
                { label: "Avis client", desc: "Notification lors d'un nouvel avis" },
                { label: "Rapport hebdomadaire", desc: "Resume des ventes chaque semaine" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Changer le mot de passe</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label>Mot de passe actuel</Label>
                <Input className="mt-1.5" type="password" />
              </div>
              <div>
                <Label>Nouveau mot de passe</Label>
                <Input className="mt-1.5" type="password" />
              </div>
              <div>
                <Label>Confirmer le mot de passe</Label>
                <Input className="mt-1.5" type="password" />
              </div>
              <Button className="w-fit">Mettre a jour</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
