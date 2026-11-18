import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { useProviderSettings } from "@/hooks/useProviderSettings"
import { toast } from "@/hooks/useToast"

import { LANGUAGE_OPTIONS } from "../../shared/languages"
import type { ProviderSettings } from "../../shared/settings"

export const providerSettingsSchema = z.object({
  baseUrl: z
    .string()
    .min(1, "AI endpoint is required.")
    .refine(
      (v) => {
        try {
          const url = new URL(v)
          return (
            url.protocol === "https:" ||
            (url.protocol === "http:" &&
              (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
          )
        } catch {
          return false
        }
      },
      { message: "Must be an HTTPS URL, or HTTP on localhost." },
    ),
  model: z.string().min(1, "Model name is required."),
  apiKey: z.string().min(1, "API key is required."),
  targetLanguage: z.string().min(1, "Target language is required."),
  customPrompt: z.string().max(2000, "Max 2 000 characters."),
})

export type ProviderFormValues = z.infer<typeof providerSettingsSchema>

export function toProviderFormValues(settings: ProviderSettings): ProviderFormValues {
  return {
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    targetLanguage: settings.targetLanguage,
    customPrompt: settings.customPrompt ?? "",
  }
}

const CARD_TITLE_CLASS = "text-muted-foreground text-[13px] font-semibold tracking-wide uppercase"

type ProviderSettingsPanelProps = {
  form: UseFormReturn<ProviderFormValues>
  provider: ReturnType<typeof useProviderSettings>
}

export function ProviderSettingsPanel({ form, provider }: ProviderSettingsPanelProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const { draft, loaded, updateDraft, save, testProvider } = provider

  const watchedValues = form.watch()

  const showError = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback)

  const handleSave = form.handleSubmit(async () => {
    setSaving(true)
    try {
      await save()
      form.reset(form.getValues())
      toast.success("Provider settings saved.")
    } catch (error) {
      showError(error, "Could not save provider settings or endpoint permission was denied.")
    } finally {
      setSaving(false)
    }
  })

  const handleTest = async () => {
    const valid = await form.trigger(["baseUrl", "model", "apiKey"], { shouldFocus: true })
    if (!valid) return
    setTesting(true)
    try {
      await testProvider()
      form.reset(form.getValues())
      toast.success("Provider test succeeded. Settings saved.")
    } catch (error) {
      showError(error, "Provider test failed.")
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    if (!loaded) return
    form.reset(toProviderFormValues(draft))
  }, [loaded])

  useEffect(() => {
    updateDraft({
      baseUrl: watchedValues.baseUrl,
      model: watchedValues.model,
      apiKey: watchedValues.apiKey,
      targetLanguage: watchedValues.targetLanguage,
      customPrompt: watchedValues.customPrompt,
    })
  }, [
    watchedValues.baseUrl,
    watchedValues.model,
    watchedValues.apiKey,
    watchedValues.targetLanguage,
    watchedValues.customPrompt,
  ])

  return (
    <Form {...form}>
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          <Card>
            <CardHeader className="px-4">
              <CardTitle className={CARD_TITLE_CLASS}>Connection</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 px-4">
              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI endpoint</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="base-url"
                        type="url"
                        placeholder="https://api.example.com/v1"
                        aria-describedby="base-url-error"
                        aria-invalid={!!form.formState.errors.baseUrl}
                      />
                    </FormControl>
                    <FormMessage id="base-url-error" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="model"
                        placeholder="gpt-4o-mini"
                        aria-invalid={!!form.formState.errors.model}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API key</FormLabel>
                    <FormControl>
                      <div className="flex gap-1.5">
                        <Input
                          {...field}
                          id="api-key"
                          type={apiKeyVisible ? "text" : "password"}
                          placeholder="sk-..."
                          aria-invalid={!!form.formState.errors.apiKey}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={apiKeyVisible ? "Hide API key" : "Show API key"}
                              onClick={() => setApiKeyVisible((v) => !v)}
                            >
                              {apiKeyVisible ? <EyeOff /> : <Eye />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {apiKeyVisible ? "Hide API key" : "Show API key"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                disabled={testing}
                onClick={() => void handleTest()}
              >
                {testing ? <Loader2 className="animate-spin" /> : null}
                Test provider
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4">
              <CardTitle className={CARD_TITLE_CLASS}>Translation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 px-4">
              <FormField
                control={form.control}
                name="targetLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Translate to</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger ref={field.ref} id="target-language" className="w-full">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom translation instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        id="custom-prompt"
                        rows={3}
                        maxLength={2000}
                        placeholder="Example: Keep product names in English and use our team's terminology."
                      />
                    </FormControl>
                    <FormDescription>
                      Optional. Applied in addition to Slacktor's required translation and output
                      rules.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="bg-background sticky bottom-0 z-10 -mx-4 -mb-4 border-t px-4 py-3">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save provider settings
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
