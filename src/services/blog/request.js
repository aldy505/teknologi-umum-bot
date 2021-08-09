import { request } from 'undici';

async function getTheDevRead(query) {
  const data = [];

  try {
    const tulisan = await requestDataByMedia('tulisan', query);
    const media = await requestDataByMedia('web', query);
    data.push(...tulisan);
    data.push(...media);
  } catch (e) {
    return 'API lagi ngambek';
  }

  return data;
}

async function requestDataByMedia(mediaType, query) {
  const url = new URL('https://api.pulo.dev/v1/contents');
  url.searchParams.append('page', 1);
  url.searchParams.append('media', mediaType);
  url.searchParams.append('query', query);

  const { body } = await request(url.toString());
  const { data } = await body.json();
  return data;
}

export { getTheDevRead };
