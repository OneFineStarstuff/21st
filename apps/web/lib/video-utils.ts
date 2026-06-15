import { UseFormReturn } from "react-hook-form"

export async function convertVideoToMP4(file: File): Promise<File> {
  const videoFormData = new FormData()
  videoFormData.append("video", file)

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/convert`,
      {
        method: "POST",
        body: videoFormData,
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to process video")
    }

    const processedVideoBlob = await response.blob()

    return new File(
      [processedVideoBlob],
      file.name.replace(/\.[^/.]+$/, ".mp4"),
      {
        type: "video/mp4",
      },
    )
  } catch (error) {
    return new File([file], file.name, { type: file.type })
  }
}

export async function handleVideoProcessing(
  file: File,
  form: UseFormReturn<any>,
  type: "image" | "video",
  paths: {
    imageUrl: string,
    imageFile: string,
    videoUrl: string,
    videoFile: string
  },
  setIsProcessingVideo: (_val: boolean) => void
) {
  const maxSize = type === "image" ? 5 * 1024 * 1024 : 50 * 1024 * 1024
  if (file.size > maxSize) {
    const sizeInMb = maxSize / (1024 * 1024)
    throw new Error(`File is too large. Maximum size is ${sizeInMb} MB`)
  }

  try {
    const previewUrl = URL.createObjectURL(file)

    if (type === "image") {
      form.setValue(paths.imageUrl as any, previewUrl)
      form.setValue(paths.imageFile as any, file)
    } else {
      setIsProcessingVideo(true)
      form.setValue(paths.videoUrl as any, previewUrl)
      form.setValue(paths.videoFile as any, file)
    }
  } finally {
    if (type === "video") {
      setIsProcessingVideo(false)
    }
  }
}
