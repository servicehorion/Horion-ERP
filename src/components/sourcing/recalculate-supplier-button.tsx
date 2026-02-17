"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { recalculateSupplierIntelligence } from "@/lib/actions/supplier-intelligence.actions"
import { useRouter } from "next/navigation"

interface RecalculateSupplierButtonProps {
  supplierId: string
}

export function RecalculateSupplierButton({ supplierId }: RecalculateSupplierButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRecalculate = async () => {
    setLoading(true)
    try {
      const result = await recalculateSupplierIntelligence(supplierId)
      if (result.error) {
        console.error(result.error)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRecalculate}
      disabled={loading}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Calcul..." : "Recalculer Intelligence"}
    </Button>
  )
}
