import { Client } from "https://deno.land/x/postgres/mod.ts";

const client = new Client({
  user: Deno.env.get("POSTGRES_USER"),
  password: Deno.env.get("POSTGRES_PASSWORD"),
  database: Deno.env.get("POSTGRES_DB"),
  hostname: "localhost",
  port: 5432,
});

await client.connect();

{
  const result = await client.queryArray(
    `SELECT to_json(cvs)
    FROM api.cvs cvs
    ORDER BY LENGTH(to_json(cvs)::text) DESC
    LIMIT 5`,
  );
  const { rows } = result;

  if (result.rows.length === 0) {
    Deno.exit(0);
  }

  const ollamaEndpoint = "http://localhost:11434/api/embed";

  const skipEmbeddingGeneration = Deno.args.includes("--skip-embed");

  if (!skipEmbeddingGeneration) {
    const response = await fetch(ollamaEndpoint, {
      method: "POST",
      body: JSON.stringify({
        model: "mxbai-embed-large",
        input: rows.map((r) => JSON.stringify(r)),
      }),
    });

    const embeddings = await response.json();

    assert(response.status, 200);
    assert(embeddings.embeddings.length, rows.length);
    const values = rows.map((r, idx) => `($})`);

    const queryString = `INSERT INTO public.cv_vectors(id, vector)
    VALUES ${rows.map((_r, idx) => `($ID_${idx}, $VECT_${idx})`).join(",\n")}
    ON CONFLICT (id) DO UPDATE
    SET vector = public.cv_vectors.vector`;

    const queryArgs = {};

    for (const idx in rows) {
      Object.assign(queryArgs, {
        [`id_${idx}`]: rows[idx][0].id,
        [`vect_${idx}`]: JSON.stringify(embeddings.embeddings[0]),
      });
    }

    const vector_updates = await client.queryArray(queryString, queryArgs);
  }

  let userInput = "I want a developer that is good at javascript";
  userInput =
    Deno.args.find((e) => e.indexOf("--input=") !== -1)?.split("--input=")[1] ??
    userInput;

  const userInputEmbedResponse = await fetch(ollamaEndpoint, {
    method: "POST",
    body: JSON.stringify({
      model: "mxbai-embed-large",
      input: userInput,
    }),
  });

  assert(userInputEmbedResponse.status, 200);

  const userInputEmbedding = await userInputEmbedResponse.json();

  const bestMatchesResult = await client.queryObject(
    `
      select cv.id, dissimilarity, euclidean_distance, full_name, skills, job_titles
from (select id,
             vect.vector <=> $INPUT_VECTOR as dissimilarity,
             vect.vector <-> $INPUT_VECTOR as euclidean_distance
      from public.cv_vectors vect
      ) as fv
         inner join api.cvs cv on cv.id = fv.id
order by dissimilarity ASC
LIMIT 10
    `,
    {
      input_vector: JSON.stringify(userInputEmbedding.embeddings[0]),
    },
  );

  const {
    rows: bestMatches,
    query: { args, ...queryRest },
    ...rest
  } = bestMatchesResult;
  console.log({ bestMatches });
}

function assert(expression: boolean): void;
function assert(left: any, right: any): void;
function assert(...args: any[]): void {
  const assertError = new Error("Assert Failed");
  const badParamsError = new Error("Bad params received");
  if (args.length === 1) {
    const [expression] = args;
    if (!expression) {
      throw assertError;
    }
  } else if (args.length === 2) {
    const [left, right] = args;
    if (left !== right) {
      throw assertError;
    }
  } else {
    throw badParamsError;
  }
}
