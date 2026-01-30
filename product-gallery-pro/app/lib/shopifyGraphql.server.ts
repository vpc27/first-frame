/**
 * Shopify Admin GraphQL helpers for Product Gallery Pro.
 * Use with the admin client from authenticate.admin(request).
 */

export const PRODUCTS_LIST = `#graphql
  query ProductsList($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PRODUCT_WITH_MEDIA = `#graphql
  query ProductWithMedia($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      productType
      vendor
      media(first: 50) {
        nodes {
          alt
          mediaContentType
          preview {
            image {
              url
            }
          }
          ... on MediaImage {
            id
            image {
              url
              altText
            }
          }
          ... on Video {
            id
            sources {
              url
              mimeType
            }
          }
          ... on ExternalVideo {
            id
          }
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          selectedOptions {
            name
            value
          }
          image {
            url
          }
        }
      }
    }
  }
`;

export const PRODUCT_UPDATE_MEDIA_ALT = `#graphql
  mutation ProductUpdateMediaAlt($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media {
        id
        alt
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

export type ProductsListResult = {
  products: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type MediaNode = {
  id: string;
  alt: string | null;
  mediaContentType?: "IMAGE" | "VIDEO" | "EXTERNAL_VIDEO" | string;
  image?: {
    url: string;
    altText: string | null;
  } | null;
  sources?: Array<{ url: string; mimeType: string }>;
  preview?: { image: { url: string } | null } | null;
};

export type ProductWithMediaResult = {
  product: {
    id: string;
    title: string;
    handle: string;
    productType: string | null;
    vendor: string;
    media: {
      nodes: MediaNode[];
    };
    variants: {
      nodes: Array<{
        id: string;
        title: string;
        selectedOptions: Array<{
          name: string;
          value: string;
        }>;
        image: {
          url: string;
        } | null;
      }>;
    };
  } | null;
};
