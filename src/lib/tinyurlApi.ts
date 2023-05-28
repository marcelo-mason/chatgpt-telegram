import axios from 'axios'

export async function shortenUrl(url: string) {
  const tinyUrlAPI = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`

  try {
    const response = await axios.get(tinyUrlAPI)
    if (response.status >= 400) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.data.toString().replace('http://', 'https://')
  } catch (error) {
    throw error
  }
}
