// MyComponent.tsx

import React from 'react';

interface ApolloFeatureDetailsProps {
  name: string;
}

const ApolloFeatureDetails: React.FC<ApolloFeatureDetailsProps> = ({ name }) => {
  return (
    <div>
      <h1>Hello, {name}!</h1>
      <p>This is a simple React component.</p>
    </div>
  );
};

export default ApolloFeatureDetails;
