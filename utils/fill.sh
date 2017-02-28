for i in asset/Icon/*; do
	if [ "$(cat "$i" | grep 'stroke="#')" -a "$(echo "$i" | grep -v -- -enabled)" ]; then
		fillfile="$(echo "$i" | sed -e 's/[.]/-enabled./g')"
		echo "$i => $fillfile"
		cp "$i" "$fillfile"
		sed -i'' -e 's/stroke="\(#[^"]*\)"/fill="\1" stroke="\1"/g' $fillfile
	fi
done
