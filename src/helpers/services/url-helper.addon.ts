import { ParamsType } from '../types/params.type';

export class UrlHelperAddon {
  buildUrl(config: {
    base: string | URL;
    path?: string;
    queryParams?: ParamsType;
    pathParams?: ParamsType;
  }): URL {
    const { base, path, queryParams, pathParams } = config;
    const urlString = typeof base === 'string' ? base : base.href;
    const baseUrlReplaced = this.interpolate(urlString, pathParams);
    const pathReplaced = path && this.interpolate(path, pathParams);
    const baseUrlFinal = this.#buildUrlFromString(
      baseUrlReplaced,
      pathReplaced,
    );
    return this.#buildUrlWithQuery(baseUrlFinal, queryParams);
  }

  #buildUrlWithQuery(baseUrl: string | URL, queryParams?: ParamsType): URL {
    const url =
      typeof baseUrl === 'string' ? this.#buildUrlFromString(baseUrl) : baseUrl;

    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key];
        if (value != null) {
          url.searchParams.set(key, value.toString());
        }
      });
    }

    return url;
  }

  #buildUrlFromString(baseUrl: string, path?: string): URL {
    const urlObject = new URL(baseUrl);

    if (path) {
      // Remove leading slash from path if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;

      // Combine the pathname with the new path
      const existingPath = urlObject.pathname.endsWith('/')
        ? urlObject.pathname
        : `${urlObject.pathname}/`;
      urlObject.pathname = existingPath + cleanPath;
    }

    return urlObject;
  }

  interpolate(template: string, params?: ParamsType): string {
    if (!params) {
      return template;
    }

    let result = template;
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value != null) {
        result = result.replace(
          new RegExp(`\\{${key}\\}`, 'gi'),
          value.toString(),
        );
      }
    });

    return result;
  }
}
