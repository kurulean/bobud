import * as ImageManipulator from 'expo-image-manipulator'

export async function compressImage(
  uri: string,
  maxWidth: number = 1080,
  quality: number = 0.7,
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    )
    return result.uri
  } catch (e) {
    console.warn('[image] compress failed, using original:', e)
    return uri
  }
}
