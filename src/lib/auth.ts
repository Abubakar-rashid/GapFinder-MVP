// src/lib/auth.ts
import { supabase } from './supabaseClient'

export interface AuthUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

// Sign up new user
export const signUp = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error
    
    return { user: data.user, error: null }
  } catch (error) {
    console.error('Error signing up:', error)
    return { user: null, error: error as Error }
  }
}

// Sign in existing user
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    
    return { user: data.user, error: null }
  } catch (error) {
    console.error('Error signing in:', error)
    return { user: null, error: error as Error }
  }
}

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error signing in with Google:', error)
    return { data: null, error: error as Error }
  }
}

// Sign out user
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) throw error
    
    return { error: null }
  } catch (error) {
    console.error('Error signing out:', error)
    return { error: error as Error }
  }
}

// Get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) throw error
    
    return { user, error: null }
  } catch (error) {
    console.error('Error getting current user:', error)
    return { user: null, error: error as Error }
  }
}

// Reset password
export const resetPassword = async (email: string) => {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error resetting password:', error)
    return { data: null, error: error as Error }
  }
}

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}