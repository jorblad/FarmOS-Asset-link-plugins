import { ref, watch } from 'vue';
import { uuidv4 } from "assetlink-plugin-api";

// Shared photo-capture carousel logic used by several dialog plugins.
// Returns reactive refs to bind in the template:
//   - capturedPhotos:   array of { id, fileName, fileDataUrl }
//   - photoCaptureModel: the <photo-input> v-model
//   - carouselPosition: which carousel slide is currently shown
export function usePhotoCapture() {
  const capturedPhotos = ref([]);
  const photoCaptureModel = ref(null);
  const carouselPosition = ref("capture-photo");

  watch(photoCaptureModel, async () => {
    const file = photoCaptureModel.value;

    if (!file) {
      return;
    }

    const fileToArrayBuffer = data => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(data);
    });

    const fileName = file.name;
    const fileType = file.type;
    const fileData = await fileToArrayBuffer(file);

    const fileStringData = new Uint8Array(fileData).reduce((data, byte) => {
      return data + String.fromCharCode(byte);
    }, '');

    const fileDataUrl = `data:${fileType};base64, ` + btoa(fileStringData);

    const photoId = uuidv4();

    capturedPhotos.value.push({
      id: photoId,
      fileName,
      fileDataUrl,
    });

    carouselPosition.value = photoId;
  });

  return { capturedPhotos, photoCaptureModel, carouselPosition };
}
