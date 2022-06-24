import { NextSeo } from "next-seo";
import { isMultiLanguage } from "../../lib/isMultiLanguage";
import { getPreview } from "../../lib/getPreview";
import { getPaths } from "../../lib/getPaths";
import {
  getCurrentLocaleStore,
  globalDrupalStateAuthStores,
  globalDrupalStateStores,
} from "../../lib/drupalStateContext";

import Link from "next/link";
import Layout from "../../components/layout";

export default function PageTemplate({ page, footerMenu, hrefLang }) {
  return (
    <Layout footerMenu={footerMenu}>
      <NextSeo
        title="Decoupled Next Drupal Demo"
        description="Generated by create next app."
        languageAlternates={hrefLang}
      />
      <article className="prose lg:prose-xl mt-10 mx-auto">
        <h1>{page.title}</h1>

        <Link passHref href="/pages">
          <a className="font-normal">Pages &rarr;</a>
        </Link>

        <div className="mt-12 max-w-lg mx-auto lg:grid-cols-3 lg:max-w-screen-lg">
          <div dangerouslySetInnerHTML={{ __html: page.body.value }} />
        </div>
      </article>
    </Layout>
  );
}

export async function getStaticPaths(context) {
  try {
    const paths = await getPaths(
      context,
      globalDrupalStateStores,
      "node--page",
      "alias",
      // basic pages are not prefixed by default
      "pages"
    );

    return {
      paths,
      fallback: false,
    };
  } catch (error) {
    console.error("Failed to fetch paths for pages:", error);
  }
}

export async function getStaticProps(context) {
  const { locales, locale } = context;
  const multiLanguage = isMultiLanguage(context.locales);
  const lang = context.preview ? context.previewData.previewLang : locale;
  const store = getCurrentLocaleStore(
    lang,
    context.preview ? globalDrupalStateAuthStores : globalDrupalStateStores
  );

  // handle nested alias like /pages/featured
  const alias = `${context.params.alias
    .map((segment) => `/${segment}`)
    .join("")}`;

  store.params.clear();
  context.preview && (await getPreview(context, "node--page"));
  let page;
  try {
    page = await store.getObjectByPath({
      objectName: "node--page",
      // note: pages are not prefixed by default.
      path: `${multiLanguage ? lang : ""}${alias}`,
      query: `
          {
            id
            title
            body
            path {
              alias
              langcode
            }
          }
        `,
      // if preview is true, force a fetch to Drupal
      refresh: context.preview,
    });
  } catch (error) {
    // retry the fetch with `/pages` prefix
    page = await store.getObjectByPath({
      objectName: "node--page",
      // note: pages are not prefixed by default.
      path: `${multiLanguage ? lang : ""}/pages${alias}`,
      query: `
            {
              id
              title
              body
              path {
                alias
                langcode
              }
            }
          `,
      // if preview is true, force a fetch to Drupal
      refresh: context.preview,
    });
  }

  store.params.clear();

  const footerMenu = await store.getObject({
    objectName: "menu_items--main",
  });

  const origin = process.env.NEXT_PUBLIC_FRONTEND_URL;
  // Load all the paths for the current page content type.
  const paths = locales.map(async (locale) => {
    const storeByLocales = getCurrentLocaleStore(
      locale,
      context.preview ? globalDrupalStateAuthStores : globalDrupalStateStores
    );
    const { path } = await storeByLocales.getObject({
      objectName: "node--page",
      id: page.id,
    });
    return path;
  });

  // Resolve all promises returned as part of paths
  // and prepare hrefLang.
  const hrefLang = await Promise.all(paths).then((values) => {
    return values.map((value) => {
      return {
        hrefLang: value.langcode,
        href: origin + "/" + value.langcode + value.alias,
      };
    });
  });

  return {
    props: {
      page,
      footerMenu,
      hrefLang,
    },
    revalidate: 60,
  };
}
