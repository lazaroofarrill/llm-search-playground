ARG PG_MAJOR=17
FROM postgres:$PG_MAJOR
ARG PG_MAJOR

RUN apt-get update && \
		apt-mark hold locales && \
		apt-get install -y --no-install-recommends build-essential postgresql-server-dev-$PG_MAJOR git ca-certificates

WORKDIR /tmp

RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git

WORKDIR /tmp/pgvector
RUN	make clean && \
		make OPTFLAGS="" && \
		make install && \
		mkdir /usr/share/doc/pgvector && \
		cp LICENSE README.md /usr/share/doc/pgvector && \
		rm -r /tmp/pgvector && \
		apt-get remove -y build-essential postgresql-server-dev-$PG_MAJOR && \
		apt-get autoremove -y && \
		apt-mark unhold locales && \
		rm -rf /var/lib/apt/lists/*
