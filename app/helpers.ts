export const onlyUnique = (value, index, array) => {
  return array.indexOf(value) === index;
}

export const getIdFromHref = (tagA) => {
  const splitByUnderscores = tagA.getAttribute('href').split('.html')[0].split('_')
  return splitByUnderscores[splitByUnderscores.length - 1]
}

export const getIdFromFilename = (filename) => {
  const splitByUnderscores = filename.split('.html')[0].split('_')
  return splitByUnderscores[splitByUnderscores.length - 1]
}

export const getSlugFromFilename = (filename) => {
  if (filename) {
    const splitByUnderscores = filename.split('.html')[0].split('_')
    const id = splitByUnderscores[splitByUnderscores.length - 1]
    const slug = filename.replace(`_${id}.html`, '').toLowerCase()
    return slug
  }
  return ''
}