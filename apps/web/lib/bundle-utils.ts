export async function fetchBundleApi(body: any) {
  const response = await fetch(`/api/bundle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}
