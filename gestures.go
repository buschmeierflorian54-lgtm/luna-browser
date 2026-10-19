package main

import "browser-mac/internal/store"

func (a *App) GestureBindings() map[string]store.GestureBinding { return a.st.Gestures() }
func (a *App) SetGestureBinding(letter, action, value string) (map[string]store.GestureBinding, error) {
	return a.st.SetGestureBinding(letter, action, value)
}
func (a *App) ResetGestureBindings() (map[string]store.GestureBinding, error) {
	return a.st.ResetGestures()
}
