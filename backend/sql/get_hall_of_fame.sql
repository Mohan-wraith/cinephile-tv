-- Database-side aggregation for /api/hall-of-fame.
-- Joins by IMDb tconst because this database intentionally has no FK from
-- ratings.tconst to episodes.tconst (ratings also contains non-episode titles).
-- This function is read-only and returns all five Hall of Fame sections.
CREATE OR REPLACE FUNCTION public.get_hall_of_fame()
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
SET statement_timeout = '15s'
SET work_mem = '8MB'
AS $function$
WITH eligible_episodes AS MATERIALIZED (
  SELECT
    e.tconst AS "tconst",
    e."parentTconst" AS "showTconst",
    e."seasonNumber" AS "seasonNumber",
    e."episodeNumber" AS "episodeNumber",
    e."primaryTitle" AS "epTitle",
    r."averageRating" AS "averageRating",
    r.numvotes AS "numVotes",
    s."primaryTitle" AS "showTitle",
    s."startYear" AS "startYear",
    s."numVotes" AS "showVotes",
    s."averageRating" AS "showRating"
  FROM public.episodes AS e
  JOIN public.ratings AS r ON r.tconst = e.tconst
  JOIN public.shows AS s ON s.tconst = e.parentTconst
  WHERE e."seasonNumber" > 0
    AND r.numvotes >= 1000
    AND s."numVotes" >= 50000
),
episode_rows AS (
  SELECT *
  FROM eligible_episodes
  WHERE "numVotes" >= 10000
),
ranked_episodes AS (
  SELECT
    er.*,
    ROW_NUMBER() OVER (
      PARTITION BY er."showTconst"
      ORDER BY er."averageRating" DESC, er."numVotes" DESC, er."tconst"
    ) AS best_rank,
    ROW_NUMBER() OVER (
      PARTITION BY er."showTconst"
      ORDER BY er."averageRating" ASC, er."numVotes" DESC, er."tconst"
    ) AS worst_rank
  FROM episode_rows AS er
),
season_rows AS (
  SELECT
    e."showTconst",
    e."showTitle",
    e."startYear",
    e."showVotes",
    e."showRating",
    e."seasonNumber",
    ROUND(AVG(e."averageRating")::numeric, 2) AS "seasonAvg",
    COUNT(*)::integer AS "ratedEps"
  FROM eligible_episodes AS e
  GROUP BY e."showTconst", e."showTitle", e."startYear", e."showVotes",
           e."showRating", e."seasonNumber"
  HAVING COUNT(*) >= 6
),
consistent_shows AS (
  SELECT
    e."showTconst",
    e."showTitle",
    e."startYear",
    e."showVotes",
    e."showRating",
    ROUND(AVG(e."averageRating")::numeric, 2) AS "avgRating",
    ROUND(STDDEV_POP(e."averageRating")::numeric, 3) AS "ratingStdDev",
    COUNT(*)::integer AS "ratedEps"
  FROM eligible_episodes AS e
  GROUP BY e."showTconst", e."showTitle", e."startYear", e."showVotes",
           e."showRating"
  HAVING COUNT(*) >= 20
     AND AVG(e."averageRating") >= 8.0
)
SELECT json_build_object(
  'bestEpisodes', (
    SELECT COALESCE(json_agg(to_json(q) ORDER BY q."averageRating" DESC, q."numVotes" DESC), '[]'::json)
    FROM (
      SELECT "tconst", "showTconst", "seasonNumber", "episodeNumber",
             "epTitle", "averageRating", "numVotes", "showTitle",
             "startYear", "showVotes", "showRating"
      FROM ranked_episodes
      WHERE best_rank <= 2
      ORDER BY "averageRating" DESC, "numVotes" DESC, "tconst"
      LIMIT 25
    ) AS q
  ),
  'worstEpisodes', (
    SELECT COALESCE(json_agg(to_json(q) ORDER BY q."averageRating" ASC, q."numVotes" DESC), '[]'::json)
    FROM (
      SELECT "tconst", "showTconst", "seasonNumber", "episodeNumber",
             "epTitle", "averageRating", "numVotes", "showTitle",
             "startYear", "showVotes", "showRating"
      FROM ranked_episodes
      WHERE worst_rank <= 2
      ORDER BY "averageRating" ASC, "numVotes" DESC, "tconst"
      LIMIT 25
    ) AS q
  ),
  'bestSeasons', (
    SELECT COALESCE(json_agg(to_json(q) ORDER BY q."seasonAvg" DESC, q."ratedEps" DESC), '[]'::json)
    FROM (
      SELECT * FROM season_rows
      ORDER BY "seasonAvg" DESC, "ratedEps" DESC, "showTitle", "seasonNumber"
      LIMIT 25
    ) AS q
  ),
  'worstSeasons', (
    SELECT COALESCE(json_agg(to_json(q) ORDER BY q."seasonAvg" ASC, q."ratedEps" DESC), '[]'::json)
    FROM (
      SELECT * FROM season_rows
      ORDER BY "seasonAvg" ASC, "ratedEps" DESC, "showTitle", "seasonNumber"
      LIMIT 25
    ) AS q
  ),
  'mostConsistent', (
    SELECT COALESCE(json_agg(to_json(q) ORDER BY q."ratingStdDev" ASC, q."avgRating" DESC), '[]'::json)
    FROM (
      SELECT * FROM consistent_shows
      ORDER BY "ratingStdDev" ASC, "avgRating" DESC, "showTitle"
      LIMIT 25
    ) AS q
  )
);
$function$;

GRANT EXECUTE ON FUNCTION public.get_hall_of_fame() TO anon, authenticated;
