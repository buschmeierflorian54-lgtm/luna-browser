package main

import (
	"browser-mac/internal/chat"
)

type ChatConfig = chat.Config

func (a *App) ChatStatus() (chat.Config, error) { return a.chat.Config() }
func (a *App) ChatSetKey(key string) (chat.Config, error) {
	return a.chat.SetProviderKey("openrouter", key)
}
func (a *App) ChatClearKey() (chat.Config, error) { return a.chat.ClearProviderKey("openrouter") }
func (a *App) ChatProviderKey(provider, key string) (chat.Config, error) {
	return a.chat.SetProviderKey(provider, key)
}
func (a *App) ChatRemoveProviderKey(provider string) (chat.Config, error) {
	return a.chat.ClearProviderKey(provider)
}
func (a *App) ChatModels(provider string) ([]chat.ModelInfo, error) {
	return a.chat.Models(a.ctx, provider)
}
func (a *App) ChatSaveModel(slot int, provider, id string) (chat.Config, error) {
	return a.chat.SaveModel(slot, provider, id)
}
func (a *App) ChatSelectModel(slot int) (chat.Config, error) { return a.chat.SelectModel(slot) }
func (a *App) ChatList() ([]chat.Summary, error)             { return a.chat.List() }
func (a *App) ChatGet(id string) (chat.Conversation, error)  { return a.chat.Get(id) }
func (a *App) ChatCreate() (chat.Conversation, error)        { return a.chat.Create() }
func (a *App) ChatSend(id, text string) (chat.Conversation, error) {
	return a.chat.Send(a.ctx, id, text)
}
func (a *App) ChatCancel(id string) error { return a.chat.Cancel(id) }
func (a *App) ChatDelete(id string) error { return a.chat.Delete(id) }
