import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { UseFormReturn } from "react-hook-form"
import type { FormData } from "../config/utils"
import { convertVideoToMP4, handleVideoProcessing } from "@/lib/video-utils"

export function useVideoDropzone({
  form,
  demoIndex,
}: {
  form: UseFormReturn<FormData>
  demoIndex: number
}) {
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const previewVideoDataUrl = form.watch(
    `demos.${demoIndex}.preview_video_data_url`,
  )

  const handleVideoChange = async (file: File) => {
    try {
      await handleVideoProcessing(file, form as any, "video", {
        imageUrl: `demos.${demoIndex}.preview_image_data_url`,
        imageFile: `demos.${demoIndex}.preview_image_file`,
        videoUrl: `demos.${demoIndex}.preview_video_data_url`,
        videoFile: `demos.${demoIndex}.preview_video_file`,
      }, setIsProcessingVideo)

      const processedFile = await convertVideoToMP4(file)
      form.setValue(`demos.${demoIndex}.preview_video_file`, processedFile as any)
    } catch (error: any) {
      console.error("Error processing video:", error)
      alert(error.message || "Error processing video. Please try again.")
      form.setValue(`demos.${demoIndex}.preview_video_data_url`, undefined as any)
      form.setValue(`demos.${demoIndex}.preview_video_file`, undefined as any)
    }
  }

  const removeVideo = () => {
    const videoUrl = form.getValues(`demos.${demoIndex}.preview_video_data_url`)
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl as string)
    }
    form.setValue(`demos.${demoIndex}.preview_video_data_url`, undefined as any)
    form.setValue(`demos.${demoIndex}.preview_video_file`, undefined as any)
  }

  const {
    getRootProps: getVideoRootProps,
    getInputProps: getVideoInputProps,
    isDragActive: isVideoDragActive,
  } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleVideoChange(acceptedFiles[0] as File)
      }
    },
    accept: {
      "video/quicktime": [],
      "video/mp4": [],
    },
    multiple: false,
  })

  const openFileDialog = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "video/quicktime,video/mp4"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleVideoChange(file)
      }
    }
    input.click()
  }

  return {
    previewVideoDataUrl,
    isProcessingVideo,
    isVideoDragActive,
    getVideoRootProps,
    getVideoInputProps,
    handleVideoChange,
    removeVideo,
    openFileDialog,
  }
}
