"use client"
import { createContext, useContext } from "react"
export const ContentScope = createContext<"admin" | "creator">("admin")
export const useContentScope = () => useContext(ContentScope)
