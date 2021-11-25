import { useState } from "react";
import type { MetaFunction, LoaderFunction } from "remix";
import { useLoaderData, json } from "remix";
import axios from 'axios';
import cheerio from 'cheerio';
import invariant from 'tiny-invariant';
import GoogleMapReact from 'google-map-react';

type IndexData = {
  resources: Array<{ name: string; url: string }>;
  addresses: Array<Address>
};

type Address = {
  name: string;
  address: string;
  fullAddress?: string;
  hint?: string;
  lat?: number,
  lng?: number,
}

const addGeoDataToAddresses = async (addresses: Array<Address>): Promise<Array<Address>> => {
  const enrichedData = await Promise.all(addresses.map(async (item) => {
        
    const key = 'AIzaSyDXfPutx2MM5x75yeTUzd_JBt_jO7aQhTY';
  
    const encodedAddress = encodeURIComponent(item.address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${key}`;
    
    // Return the location data from the resolved request
    const response = await axios.get(url);
    if (response.status !== 200) {
      throw new Error(`Could not fetch location data for ${item.address}`);
    }
    const location = response?.data?.results[0]?.geometry?.location;
    if (!location) {
      return item
    }
    return {
      ...item,
      lat: location.lat,
      lng: location.lng
    }
  }))
  console.log(enrichedData)
  return enrichedData;
}

const loadKvhhAddresses = async () => {
	const response = await axios
    .get('https://www.kvhh.net/de/patienten/informationen-zum-corona-virus-sars-cov-2/sie-suchen-eine-corona-impfpraxis.html')
    .then((response) => {
      if (response.status === 200) {
        const html = response.data;
        const $ = cheerio.load(html);
        const addresses: Array<Address> = [];  
        // using CSS selector  
        $('figure.table table tbody tr').each((i, row) => {
          const contents = $(row).find('td')
          const name = $(contents[1]).text().trim();
          const addressCell = $(contents[2]);
          const address = $(addressCell).find('p:first-child').text().trim() + ' ' + $(addressCell).find('p:nth-child(2)').text().trim(); 
          const fullAddress = $(contents[2]).html();
          const hint = $(contents[3]).text().trim();
          
          addresses.push({name, address, fullAddress, hint});
        });
        return addresses
      }
    })
    .catch((err) => {
      throw new Error(err);
    });
  
  invariant(response, 'Could not load KVHH addresses');
  const enrichedData = await addGeoDataToAddresses(response);
  return enrichedData.filter(item => item.lat && item.lng);
};


export let loader: LoaderFunction = async () => {
  const kvhhData = await loadKvhhAddresses();  

  let data: IndexData = {
    resources: [
      {
        name: "Liste der KVHH",
        url: "https://www.kvhh.net/de/patienten/informationen-zum-corona-virus-sars-cov-2/sie-suchen-eine-corona-impfpraxis.html"
      },
    ],
    addresses: kvhhData,
  };

  // https://remix.run/api/remix#json
  return json(data);
};

// https://remix.run/api/conventions#meta
export let meta: MetaFunction = () => {
  return {
    title: "HamVaxMap",
    description: "Arztpraxen, die laut KVHH eine Corona-Impfung anbieten"
  };
};

const Marker = (props) => {
  const [isActive, setActive] = useState(false);

  const toggleClass = () => {
    setActive(!isActive);
  };

  return <div className={isActive
    ? 'superAwesomeMarker superAwesomeMarker--elevated'
    : 'superAwesomeMarker'} onClick={toggleClass}>      
    <div
      className={
        isActive
        ? 'superAwesomeMarker__popup superAwesomeMarker__popup--active'
        : 'superAwesomeMarker__popup'
      }>
      <h5 className="superAwesomeMarker__popup__title">{props.name}</h5>
      <div dangerouslySetInnerHTML={{ __html: props.address }} />
      <p>{props.hint}</p>
    </div>
  </div>
}

// https://remix.run/guides/routing#index-routes
export default function Index() {
  let data = useLoaderData<IndexData>();
  const center = {
    lat: 53.551086,
    lng: 9.993682,
  }
  const zoom = 11
  return (
    <div className="remix__page">
      <main>
        <p>Auf dieser Karte sind alle beim KVHH verzeichneten Ärzte verortet, die Corona-Impfungen anbieten.</p>
        <p><small>
          Für Korrektheit und Vollständigkeit der Daten kann ich keine Verantwortung übernehmen – diese sind von der Seite der KVHH entnommen und von dort in ein Google-Maps-konformes Format gebracht.
        </small></p>
        <div id="map">
          <GoogleMapReact
            bootstrapURLKeys={{ key: 'AIzaSyDXfPutx2MM5x75yeTUzd_JBt_jO7aQhTY' }}
            defaultCenter={center}
            defaultZoom={zoom}
          >
            {data.addresses.map((item: Address, index: number) => {
              return <Marker key={index} lat={item.lat} lng={item.lng} name={item.name} address={item.fullAddress} hint={item.hint} />
            })}
          </GoogleMapReact>
        </div>
      </main>
      <aside>
        <h2>Quelle</h2>
        <ul>
          {data.resources.map(resource => (
            <li key={resource.url} className="remix__page__resource">
              <a href={resource.url}>{resource.name}</a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
