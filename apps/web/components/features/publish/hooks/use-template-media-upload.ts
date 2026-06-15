import { useState, useRef } from "react"
import { UseFormReturn } from "react-hook-form"
import type { TemplateFormData } from "../template/schema"
import React from "react"
import { useR2Upload } from "../hooks/use-r2-upload"
import { convertVideoToMP4, handleVideoProcessing } from "@/lib/video-utils"

export function useTemplateMediaUpload(form: UseFormReturn<TemplateFormData>) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload: uploadToR2ClientSide } = useR2Upload()

  const processSelectedFile = async (file: File, type: "image" | "video") => {
    return handleVideoProcessing(file, form as any, type, {
      imageUrl: "preview_image_data_url",
      imageFile: "preview_image_file",
      videoUrl: "preview_video_data_url",
      videoFile: "preview_video_file",
    }, setIsProcessingVideo)
  }

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "video",
  ) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    await processSelectedFile(file, type)
  }

  const uploadToStorage = async (
    file: File,
    path: string,
    contentType: string,
  ) => {
    if (contentType.startsWith("video/")) {
      try {
        const convertedFile = await convertVideoToMP4(file)
        file = convertedFile
        contentType = "video/mp4"
      } catch (error) {}
    }

    return await uploadToR2ClientSide({
      file,
      fileKey: path,
      bucketName: "components-code",
      contentType,
    })
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent, type: "image" | "video") => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    await processSelectedFile(file, type)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const cleanup = () => {
    const imageUrl = form.getValues("preview_image_data_url")
    const videoUrl = form.getValues("preview_video_data_url")

    if (imageUrl && imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl)
    }
    if (videoUrl && videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl)
    }
  }

  React.useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  return {
    isDragging,
    isProcessingVideo,
    fileInputRef,
    uploadToStorage,
    handleFileChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleClick,
  }
}
