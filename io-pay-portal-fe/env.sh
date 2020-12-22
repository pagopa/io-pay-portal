#!/usr/bin/env bash

# Recreate config file
rm -rf ./env-config.js
touch ./env-config.js

# Add assignment
echo "window._env_ = {" >> ./env-config.js

# Loop on environment variables prefixed with
# io_pay_portal_var and add them to env-config.js
for io_pay_portal_var in $(env | grep -i io_pay_portal); do
    varname=$(printf '%s\n' "$io_pay_portal_var" | sed -e 's/=.*//')
    varvalue=$(printf '%s\n' "$io_pay_portal_var" | sed -e 's/^[^=]*=//')

    echo "  $varname: \"$varvalue\"," >> ./env-config.js
done

echo "}" >> ./env-config.js
