-- CreateTable
CREATE TABLE "airlines" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "airlines_pkey" PRIMARY KEY ("code")
);
-- CreateTable
CREATE TABLE "airports" (
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    CONSTRAINT "airports_pkey" PRIMARY KEY ("iata")
);
-- CreateTable
CREATE TABLE "flights" (
    "id" SERIAL NOT NULL,
    "flight_key" TEXT NOT NULL,
    "airline_code" TEXT NOT NULL,
    "flight_number" INTEGER NOT NULL,
    "dep_airport" TEXT NOT NULL,
    "arr_airport" TEXT NOT NULL,
    "dep_time_utc" TIMESTAMPTZ NOT NULL,
    "arr_time_utc" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "flights_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "flights_flight_key_key" ON "flights"("flight_key");
-- AddForeignKey
ALTER TABLE "flights"
ADD CONSTRAINT "flights_airline_code_fkey" FOREIGN KEY ("airline_code") REFERENCES "airlines"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "flights"
ADD CONSTRAINT "flights_dep_airport_fkey" FOREIGN KEY ("dep_airport") REFERENCES "airports"("iata") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "flights"
ADD CONSTRAINT "flights_arr_airport_fkey" FOREIGN KEY ("arr_airport") REFERENCES "airports"("iata") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flights"
ADD CONSTRAINT "flights_arrival_after_departure" ChECK ("arr_time_utc" > "dep_time_utc")