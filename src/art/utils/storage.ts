import { get, set, del, keys as idbKeys, createStore } from 'idb-keyval';

const sourceStore = createStore('art-pipeline-sources', 'blobs');
const resultStore = createStore('art-pipeline-results', 'blobs');
const videoStore = createStore('art-pipeline-videos', 'blobs');

export async function putSource(id: string, blob: Blob): Promise<void> {
  await set(id, blob, sourceStore);
}
export async function getSource(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, sourceStore);
}
export async function deleteSource(id: string): Promise<void> {
  await del(id, sourceStore);
}
export async function listSourceIds(): Promise<string[]> {
  return (await idbKeys(sourceStore)) as string[];
}

export async function putResult(id: string, blob: Blob): Promise<void> {
  await set(id, blob, resultStore);
}
export async function getResult(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, resultStore);
}
export async function deleteResult(id: string): Promise<void> {
  await del(id, resultStore);
}

export async function putVideo(id: string, blob: Blob): Promise<void> {
  await set(id, blob, videoStore);
}
export async function getVideo(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, videoStore);
}
export async function deleteVideo(id: string): Promise<void> {
  await del(id, videoStore);
}

export async function clearAll(): Promise<void> {
  for (const id of (await idbKeys(sourceStore)) as string[]) {
    await del(id, sourceStore);
  }
  for (const id of (await idbKeys(resultStore)) as string[]) {
    await del(id, resultStore);
  }
  for (const id of (await idbKeys(videoStore)) as string[]) {
    await del(id, videoStore);
  }
}
