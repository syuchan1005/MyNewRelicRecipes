FROM newrelic/infrastructure-bundle

RUN apk add --no-cache docker-cli coreutils

COPY integration.yml /etc/newrelic-infra/integrations.d/docker-config.yml

